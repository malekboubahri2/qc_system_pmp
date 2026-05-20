#ifndef DEFECTS_INJVIEW_HPP
#define DEFECTS_INJVIEW_HPP

#include <gui_generated/defects_inj_screen/defects_injViewBase.hpp>
#include <gui/defects_inj_screen/defects_injPresenter.hpp>
#include <touchgfx/Callback.hpp>
#include <touchgfx/events/ClickEvent.hpp>
#include <touchgfx/containers/buttons/BoxWithBorderButtonStyle.hpp>
#include <touchgfx/containers/buttons/ClickButtonTrigger.hpp>
#include <touchgfx/containers/buttons/TextButtonStyle.hpp>
#include <touchgfx/mixins/ClickListener.hpp>

class defects_injView : public defects_injViewBase
{
public:
    defects_injView();
    virtual ~defects_injView() {}
    virtual void setupScreen();
    virtual void tearDownScreen();

private:
    typedef touchgfx::ClickListener<
        touchgfx::TextButtonStyle<
            touchgfx::BoxWithBorderButtonStyle<
                touchgfx::ClickButtonTrigger>>> DefectButton;

    /* 10 numbered defects + Autre = 11 slots. INJ buttons are defect_1..defect_10 + defect_other. */
    static constexpr int DEFECT_COUNT = 11;

    bool m_selected[DEFECT_COUNT]; /* index 0..9 = defect_1..defect_10, index 10 = defect_other */
    bool m_autre_selected;

    void updateDefectButton(DefectButton& btn, bool selected);
    void updateActionButton();

    void onDefectClicked(const DefectButton& src, const touchgfx::ClickEvent& evt);
    void onNextClicked(const DefectButton& src, const touchgfx::ClickEvent& evt);

    touchgfx::Callback<defects_injView, const DefectButton&, const touchgfx::ClickEvent&> m_defectCb;
    touchgfx::Callback<defects_injView, const DefectButton&, const touchgfx::ClickEvent&> m_nextCb;
};

#endif // DEFECTS_INJVIEW_HPP
