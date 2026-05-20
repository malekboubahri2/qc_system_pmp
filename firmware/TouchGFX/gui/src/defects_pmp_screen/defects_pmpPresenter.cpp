#include <gui/defects_pmp_screen/defects_pmpView.hpp>
#include <gui/defects_pmp_screen/defects_pmpPresenter.hpp>
#include <gui/model/Model.hpp>
#include <gui/common/FrontendApplication.hpp>
#include <touchgfx/Application.hpp>

defects_pmpPresenter::defects_pmpPresenter(defects_pmpView& v)
    : view(v)
{
}

void defects_pmpPresenter::activate()
{
    checkPendingPreciserText();
}

void defects_pmpPresenter::deactivate()
{
}

void defects_pmpPresenter::openKeyboardForPreciser()
{
    model->setPreciserOrigin(Model::PreciserOrigin::PMP_DEFECTS);
    model->setPreciserPendingText("");
    static_cast<FrontendApplication*>(touchgfx::Application::getInstance())
        ->gotoinput_typeScreenNoTransition();
}

void defects_pmpPresenter::checkPendingPreciserText()
{
    if (model->getPreciserOrigin() == Model::PreciserOrigin::PMP_DEFECTS)
    {
        view.receivePreciserText(model->getPreciserPendingText());
        model->clearPreciser();
    }
}

void defects_pmpPresenter::logDefectInspection(int defectTypeId, const char* note)
{
    /* TODO: enqueue inspection event via Model → mqtt_task (ADR-014).
     * outcome="DEFECT", defect_type_id=defectTypeId, note=note */
    (void)defectTypeId;
    (void)note;
}

void defects_pmpPresenter::logOkInspection()
{
    /* TODO: enqueue inspection event via Model → mqtt_task (ADR-014).
     * outcome="OK", no defect_type_id */
}
